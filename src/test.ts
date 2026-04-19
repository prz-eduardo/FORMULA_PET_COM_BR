import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Provide common testing imports globally so specs that don't import HttpClientTestingModule
// still have a mock HttpClient available. Individual specs can still override this.
TestBed.configureTestingModule({
  imports: [HttpClientTestingModule]
});
