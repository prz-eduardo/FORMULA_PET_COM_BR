export const SUPPORT_ROOT = 'support';

export function pathClienteActive(clienteChatUid: string) {
  return `${SUPPORT_ROOT}/cliente_active/${clienteChatUid}`;
}
export function pathQueue() {
  return `${SUPPORT_ROOT}/queue`;
}
export function pathTicketQueue(tid: string) {
  return `${SUPPORT_ROOT}/queue/${tid}`;
}
export function pathAdminActive(adminUid: string) {
  return `${SUPPORT_ROOT}/admin_active/${adminUid}`;
}
export function pathTicketMeta(tid: string) {
  return `${SUPPORT_ROOT}/tickets/${tid}/meta`;
}
export function pathTicketMessages(tid: string) {
  return `${SUPPORT_ROOT}/tickets/${tid}/messages`;
}
