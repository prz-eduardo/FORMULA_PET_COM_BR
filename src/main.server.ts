import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
registerLocaleData(localePt, 'pt-BR');

// Polyfill localStorage/sessionStorage on the server to avoid ReferenceError
// during SSR when some modules access storage without proper guards.
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).localStorage === 'undefined') {
	(globalThis as any).localStorage = {
		getItem: (_key: string) => null,
		setItem: (_key: string, _val: string) => {},
		removeItem: (_key: string) => {},
	};
	(globalThis as any).sessionStorage = {
		getItem: (_key: string) => null,
		setItem: (_key: string, _val: string) => {},
		removeItem: (_key: string) => {},
	};
}

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
