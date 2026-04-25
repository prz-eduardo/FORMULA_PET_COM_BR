import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

registerLocaleData(localePt, 'pt-BR');

bootstrapApplication(AppComponent, appConfig)
  .then(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Light });
    } catch {
      /* non-fatal on some WebViews */
    }
    try {
      await SplashScreen.hide();
    } catch {
      /* non-fatal */
    }
  })
  .catch((err) => console.error(err));
