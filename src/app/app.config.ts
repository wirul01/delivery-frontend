import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, ...(environment.useHashRouting ? [withHashLocation()] : [])),
    // HttpClient ยิงตรงไป backend จริง (ไม่มี interceptor จำลองหรือแนบ token เพราะ backend ยังไม่มีระบบ login)
    provideHttpClient(),
  ],
};
