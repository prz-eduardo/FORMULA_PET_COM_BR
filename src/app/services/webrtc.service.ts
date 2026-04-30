import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RealtimeService } from './realtime.service';

type CallState = 'idle' | 'connecting' | 'connected' | 'failed' | 'ended';

@Injectable({ providedIn: 'root' })
export class WebrtcService {
  private pc: RTCPeerConnection | null = null;
  private consultaId: number | null = null;
  private ourSocketId: string | null = null;
  private remoteSocketId: string | null = null;

  private localStreamSubj = new BehaviorSubject<MediaStream | null>(null);
  public localStream$ = this.localStreamSubj.asObservable();

  private remoteStreamSubj = new BehaviorSubject<MediaStream | null>(null);
  public remoteStream$ = this.remoteStreamSubj.asObservable();

  private callStateSubj = new BehaviorSubject<CallState>('idle');
  public callState$ = this.callStateSubj.asObservable();

  private muted = false;
  private videoEnabled = true;

  constructor(private realtime: RealtimeService) {
    // negociações via signaling
    this.realtime.on('telemedicina:signal').subscribe((p: any) => this.onSignal(p));
    this.realtime.on('telemedicina:participant-joined').subscribe((p: any) => this.onParticipantJoined(p));
    this.realtime.on('telemedicina:participant-left').subscribe((p: any) => this.onParticipantLeft(p));
  }

  async joinCall(consultaId: number, salaCodigo?: string): Promise<void> {
    this.callStateSubj.next('connecting');
    this.consultaId = consultaId;

    const ack = await this.realtime.emit('telemedicina:join', { consultaId }).catch((e: unknown) => ({ ok: false, error: e }));
    if (!ack || !ack.ok) {
      this.callStateSubj.next('failed');
      throw new Error(ack?.error || 'join_failed');
    }

    this.ourSocketId = ack.socketId || ack.socketId || null;

    await this.startLocalMedia();
    this.createPeerConnection();

    // if there is already a participant, server will emit participant-joined; otherwise create offer proactively
    // create an initial offer to speed up connection
    await this.createAndSendOffer();
  }

  private async startLocalMedia(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      this.localStreamSubj.next(stream);
      this.muted = false;
      this.videoEnabled = true;
    } catch (err) {
      this.callStateSubj.next('failed');
      throw err;
    }
  }

  private createPeerConnection(): void {
    if (this.pc) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });
    this.pc = pc;

    const remoteStream = new MediaStream();
    this.remoteStreamSubj.next(remoteStream);

    pc.ontrack = (ev) => {
      try {
        ev.streams.forEach((s) => {
          s.getTracks().forEach((t) => remoteStream.addTrack(t));
        });
      } catch (e) {
        console.warn('ontrack', e);
      }
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.realtime.emit('telemedicina:signal', {
        consultaId: this.consultaId,
        candidate: ev.candidate,
        targetSocketId: this.remoteSocketId || null,
      }).catch(() => {});
    };

    const local = this.localStreamSubj.value;
    if (local) {
      local.getTracks().forEach((t) => pc.addTrack(t, local));
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'disconnected') this.callStateSubj.next('failed');
      if (s === 'connected') this.callStateSubj.next('connected');
      if (s === 'closed') this.callStateSubj.next('ended');
    };
  }

  private async createAndSendOffer(targetSocketId?: string): Promise<void> {
    if (!this.pc) this.createPeerConnection();
    if (!this.pc) throw new Error('PeerConnection não iniciado');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.realtime.emit('telemedicina:signal', {
      consultaId: this.consultaId,
      sdp: { type: 'offer', sdp: offer.sdp },
      targetSocketId: targetSocketId || this.remoteSocketId || null,
    });
  }

  private async onSignal(payload: any): Promise<void> {
    if (!payload) return;
    try {
      if (payload.fromSocketId && payload.fromSocketId === this.ourSocketId) return; // ignore our own

      if (payload.sdp) {
        const sdp = payload.sdp;
        if (sdp.type === 'offer') {
          // incoming offer -> set remote and answer
          await this.handleRemoteOffer(sdp, payload.fromSocketId);
        } else if (sdp.type === 'answer') {
          await this.handleRemoteAnswer(sdp);
        }
      }

      if (payload.candidate) {
        try {
          await this.pc?.addIceCandidate(payload.candidate);
        } catch (err) {
          console.warn('addIceCandidate falhou', err);
        }
      }
    } catch (err) {
      console.warn('onSignal error', err);
    }
  }

  private async handleRemoteOffer(sdp: any, fromSocketId?: string): Promise<void> {
    if (!this.pc) this.createPeerConnection();
    try {
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      this.remoteSocketId = fromSocketId || null;
      await this.realtime.emit('telemedicina:signal', {
        consultaId: this.consultaId,
        sdp: { type: 'answer', sdp: answer.sdp },
        targetSocketId: fromSocketId || null,
      });
    } catch (err) {
      console.warn('handleRemoteOffer error', err);
    }
  }

  private async handleRemoteAnswer(sdp: any): Promise<void> {
    try {
      await this.pc!.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.warn('handleRemoteAnswer error', err);
    }
  }

  private onParticipantJoined(payload: any): void {
    const otherSocketId = payload?.socketId;
    if (!otherSocketId || otherSocketId === this.ourSocketId) return;
    this.remoteSocketId = otherSocketId;
    // try to create offer targeted to this new participant
    this.createAndSendOffer(otherSocketId).catch((e) => console.warn('createOffer fail', e));
  }

  private onParticipantLeft(_payload: any): void {
    // participant left — keep call open, remote stream will change state
  }

  toggleMute(): boolean {
    const stream = this.localStreamSubj.value;
    if (!stream) return this.muted;
    this.muted = !this.muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    return this.muted;
  }

  toggleVideo(): boolean {
    const stream = this.localStreamSubj.value;
    if (!stream) return this.videoEnabled;
    this.videoEnabled = !this.videoEnabled;
    stream.getVideoTracks().forEach((t) => (t.enabled = this.videoEnabled));
    return this.videoEnabled;
  }

  endCall(): void {
    if (this.pc) {
      try {
        this.pc.getSenders().forEach((s) => s.track?.stop());
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    const local = this.localStreamSubj.value;
    if (local) local.getTracks().forEach((t) => t.stop());
    this.localStreamSubj.next(null);
    this.remoteStreamSubj.next(null);
    this.callStateSubj.next('ended');
    if (this.consultaId) {
      this.realtime.emit('telemedicina:leave', { consultaId: this.consultaId }).catch(() => {});
    }
    this.consultaId = null;
    this.ourSocketId = null;
    this.remoteSocketId = null;
  }
}
