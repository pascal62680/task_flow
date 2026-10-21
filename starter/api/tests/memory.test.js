import { createMemoryRepository } from '../src/repositories/memory.js';
import { describeRepositoryContract } from './repository-contract.js';

describeRepositoryContract('memory', () => createMemoryRepository());
