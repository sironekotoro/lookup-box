import type { DatasetBundle, LookupProvider } from '../types';
import { mockBundles } from '../mock';

export class MockProvider implements LookupProvider {
  id = 'mock';
  label = 'Mock';
  async load(): Promise<DatasetBundle[]> {
    return structuredClone(mockBundles);
  }
}
