import {describe,it,expect} from 'vitest';
import {formatINR,formatDate} from './client';
describe('banking display formatters',()=>{
 it('formats integer paise as INR',()=>{expect(formatINR(123456)).toContain('1,234.56');});
 it('returns a safe placeholder for invalid dates',()=>{expect(formatDate('not-a-date')).toBe('—');});
});
