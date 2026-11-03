import {defineConfig} from 'vitest/config';
/** Offline regression suite: no dotenv setup, database bootstrap or external storage. */
export default defineConfig({test:{globals:true,setupFiles:[],fileParallelism:false,include:[
 'src/domain/application/services/explore-ranking-engine.spec.ts',
 'src/domain/application/services/explore-cursor-token.spec.ts',
 'src/domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed.spec.ts',
 'src/infra/http/controllers/barbershop/explore-feed.controller.spec.ts',
 'src/infra/http/controllers/service/update-service.controller.spec.ts',
 'src/domain/application/use-cases/media/media-use-cases.spec.ts',
 'src/domain/application/use-cases/service/**/*.spec.ts',
 'src/infra/drizzle/demo-seed/canonical/ten-barbershops.spec.ts',
 'src/infra/drizzle/demo-seed/canonical/retired-barbershops.spec.ts',
 'src/infra/drizzle/demo-seed/canonical/fixtures.spec.ts',
 'src/infra/storage/r2-storage-service.spec.ts'
]}});
