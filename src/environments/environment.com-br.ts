/**
 * Substituído via `ng build --configuration=com-br` (deploy do domínio .com.br / branch production).
 * Dev no Vercel continua com environment.ts padrão (`comingSoon: false`).
 */
export const environment = {
  production: true,
  comingSoon: true,
  apiBaseUrl: 'https://petspherecombrbackend-production.up.railway.app'
};
