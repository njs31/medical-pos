import { describe, expect, it } from 'vitest';
import { buildSupplierOptions, findSupplierOption } from './supplierOptions';

describe('supplier options', () => {
  const saved = [{ id: 1, name: 'Sri Soumya Medicals' }, { id: 2, name: 'Ankur Pharmacy' }];
  const used = ['SRI SOUMYA MEDICALS', 'HARSHA  AGENCY', '', null, 'Harsha Agency'];

  it('merges saved suppliers with names used on stock, one per distributor', () => {
    const options = buildSupplierOptions(saved, used);
    expect(options).toEqual([
      { name: 'Ankur Pharmacy', saved: true },
      { name: 'HARSHA AGENCY', saved: false },
      { name: 'Sri Soumya Medicals', saved: true },
    ]);
  });

  it('matches names regardless of case and spacing', () => {
    const options = buildSupplierOptions(saved, used);
    expect(findSupplierOption(options, ' sri  soumya medicals ')?.name).toBe('Sri Soumya Medicals');
    expect(findSupplierOption(options, 'New Pharma Distributors')).toBeNull();
    expect(findSupplierOption(options, '')).toBeNull();
  });
});
