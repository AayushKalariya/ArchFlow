#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/28b5b6d78d9dd75f41606c00976a5514ee66d8f1602443d27da7ce2b1d7982bb/contract';
import startContract from '../../snapshots/28b5b6d78d9dd75f41606c00976a5514ee66d8f1602443d27da7ce2b1d7982bb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/badc6e2aebcaf86034c5bdcf749b5f6bcc2f3a01cf7da60f393345b39752a9ef/contract';
import endContract from '../../snapshots/badc6e2aebcaf86034c5bdcf749b5f6bcc2f3a01cf7da60f393345b39752a9ef/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'project',
        column: col('slug', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'project',
        constraint: 'project_slug_key',
        columns: ['slug'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
