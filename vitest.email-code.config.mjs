import {defineConfig} from 'vitest/config';
export default defineConfig({test:{globals:true,setupFiles:[],fileParallelism:false,testTimeout:20000,env:{NODE_ENV:'test',DATABASE_URL:'postgresql://blocked:blocked@127.0.0.1:9/blocked',JWT_SECRET:'synthetic-email-code-key-not-a-production-secret',RESEND_API_KEY:'synthetic-no-external-mail',EMAIL_FROM:'test@example.invalid',APP_URL:'http://127.0.0.1'},include:[
 'src/domain/application/use-cases/users/send-email-verification/send-email-verification.spec.ts',
 'src/domain/application/use-cases/users/verify-email/verify-email.spec.ts',
 'src/infra/http/controllers/verify-email.controller.spec.ts',
 'src/infra/email/render-verification-email.spec.tsx',
 'src/domain/application/services/email-verification-code-service.spec.ts',
 'src/domain/application/services/email-verification-token-service.spec.ts',
 'src/infra/http/client-onboarding.integration.spec.ts'
]}});
