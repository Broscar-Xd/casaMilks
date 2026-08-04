import { customerRepository } from '../repositories/customer.repository';
import { UpsertCustomerInput } from '../validators/customer.validator';

export const customerService = {
  list: (branchId: string, search?: string) => customerRepository.list(branchId, search),
  upsert: (input: UpsertCustomerInput) => customerRepository.upsert(input),
};
