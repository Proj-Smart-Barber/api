import {it,expect} from 'vitest';
import {right} from '../../../../core/logic/either';
import {FetchUnitBookingsController} from './fetch-unit-bookings.controller';
import type {FetchUnitBookingsUseCase} from '../../../../domain/application/use-cases/barbershop/fetch-unit-bookings/fetch-unit-bookings';
it('does not advertise an omitted summary or lower-bound total as an exact global count',async () => {
 const useCase={execute:async () => right({items:[],page:2,limit:20,total:41,hasNext:true,actorRole:'OWNER',serverTime:new Date().toISOString(),summary:{totalBookings:41,totalAmountInCents:0,statusCounts:{},hasIncompleteData:false}})};
 const controller=new FetchUnitBookingsController(useCase as unknown as FetchUnitBookingsUseCase);
 const response=await controller.handle({shopId:'10000000-0000-4000-8000-000000000001',userId:'10000000-0000-4000-8000-000000000002',page:2,includeSummary:false});
 expect(response.statusCode).toBe(200);expect(response.body).not.toHaveProperty('summary');expect(response.body).toHaveProperty('totalIsExact',false);
});
