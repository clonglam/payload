import type { TransactionOptions } from 'mongodb'
import type { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { ClientSession, ConnectOptions, Connection, SchemaOptions } from 'mongoose'
import type { BaseDatabaseAdapter, DatabaseAdapterObj, Payload } from 'payload'

import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { createDatabaseAdapter } from 'payload'

import type { CollectionModel, GlobalModel } from './types.js'

import { connect } from './connect.js'
import { count } from './count.js'
import { create } from './create.js'
import { createGlobal } from './createGlobal.js'
import { createGlobalVersion } from './createGlobalVersion.js'
import { createMigration } from './createMigration.js'
import { createVersion } from './createVersion.js'
import { deleteMany } from './deleteMany.js'
import { deleteOne } from './deleteOne.js'
import { deleteVersions } from './deleteVersions.js'
import { destroy } from './destroy.js'
import { find } from './find.js'
import { findGlobal } from './findGlobal.js'
import { findGlobalVersions } from './findGlobalVersions.js'
import { findOne } from './findOne.js'
import { findVersions } from './findVersions.js'
import { init } from './init.js'
import { migrateFresh } from './migrateFresh.js'
import { queryDrafts } from './queryDrafts.js'
import { beginTransaction } from './transactions/beginTransaction.js'
import { commitTransaction } from './transactions/commitTransaction.js'
import { rollbackTransaction } from './transactions/rollbackTransaction.js'
import { updateGlobal } from './updateGlobal.js'
import { updateGlobalVersion } from './updateGlobalVersion.js'
import { updateOne } from './updateOne.js'
import { updateVersion } from './updateVersion.js'

export type { MigrateDownArgs, MigrateUpArgs } from './types.js'

export interface Args {
  /** Set to false to disable auto-pluralization of collection names, Defaults to true */
  autoPluralization?: boolean
  /** Define Mongoose options on a collection-by-collection basis.
   */
  collections?: {
    [slug: string]: {
      /** Define Mongoose schema options for a given collection.
       */
      schemaOptions?: SchemaOptions
    }
  }
  /** Extra configuration options */
  connectOptions?: {
    /** Set false to disable $facet aggregation in non-supporting databases, Defaults to true */
    useFacet?: boolean
  } & ConnectOptions
  /** Set to true to disable hinting to MongoDB to use 'id' as index. This is currently done when counting documents for pagination. Disabling this optimization might fix some problems with AWS DocumentDB. Defaults to false */
  disableIndexHints?: boolean
  /** Define Mongoose options for the globals collection.
   */
  globals?: {
    schemaOptions?: SchemaOptions
  }
  migrationDir?: string
  /**
   * typed as any to avoid dependency
   */
  mongoMemoryServer?: MongoMemoryReplSet
  /** Define default Mongoose schema options for all schemas created.
   */
  schemaOptions?: SchemaOptions
  transactionOptions?: TransactionOptions | false
  /** The URL to connect to MongoDB or false to start payload and prevent connecting */
  url: false | string
}

export type MongooseAdapter = {
  collectionOptions: {
    [slug: string]: {
      schemaOptions?: SchemaOptions
    }
  }
  collections: {
    [slug: string]: CollectionModel
  }
  connection: Connection
  globals: GlobalModel
  globalsOptions: {
    schemaOptions?: SchemaOptions
  }
  mongoMemoryServer: MongoMemoryReplSet
  schemaOptions?: SchemaOptions
  sessions: Record<number | string, ClientSession>
  versions: {
    [slug: string]: CollectionModel
  }
} & Args &
  BaseDatabaseAdapter

declare module 'payload' {
  export interface DatabaseAdapter
    extends Omit<BaseDatabaseAdapter, 'sessions'>,
      Omit<Args, 'collections' | 'globals' | 'migrationDir'> {
    collectionOptions: {
      [slug: string]: {
        schemaOptions?: SchemaOptions
      }
    }
    collections: {
      [slug: string]: CollectionModel
    }
    connection: Connection
    globals: GlobalModel
    globalsOptions: {
      schemaOptions?: SchemaOptions
    }
    mongoMemoryServer: MongoMemoryReplSet
    schemaOptions?: SchemaOptions
    sessions: Record<number | string, ClientSession>
    transactionOptions: TransactionOptions
    versions: {
      [slug: string]: CollectionModel
    }
  }
}

export function mongooseAdapter({
  autoPluralization = true,
  collections,
  connectOptions,
  disableIndexHints = false,
  globals,
  migrationDir: migrationDirArg,
  mongoMemoryServer,
  schemaOptions,
  transactionOptions = {},
  url,
}: Args): DatabaseAdapterObj {
  function adapter({ payload }: { payload: Payload }) {
    const migrationDir = findMigrationDir(migrationDirArg)
    mongoose.set('strictQuery', false)

    return createDatabaseAdapter<MongooseAdapter>({
      name: 'mongoose',

      // Mongoose-specific
      autoPluralization,
      collectionOptions: collections || {},
      collections: {},
      connectOptions: connectOptions || {},
      connection: undefined,
      count,
      disableIndexHints,
      globals: undefined,
      globalsOptions: globals || {},
      mongoMemoryServer,
      schemaOptions: schemaOptions || {},
      sessions: {},
      transactionOptions: transactionOptions === false ? undefined : transactionOptions,
      url,
      versions: {},

      // DatabaseAdapter
      beginTransaction: transactionOptions ? beginTransaction : undefined,
      commitTransaction,
      connect,
      create,
      createGlobal,
      createGlobalVersion,
      createMigration,
      createVersion,
      defaultIDType: 'text',
      deleteMany,
      deleteOne,
      deleteVersions,
      destroy,
      find,
      findGlobal,
      findGlobalVersions,
      findOne,
      findVersions,
      init,
      migrateFresh,
      migrationDir,
      payload,
      queryDrafts,
      rollbackTransaction,
      updateGlobal,
      updateGlobalVersion,
      updateOne,
      updateVersion,
    })
  }

  return {
    defaultIDType: 'text',
    init: adapter,
  }
}

/**
 * Attempt to find migrations directory.
 *
 * Checks for the following directories in order:
 * - `migrationDir` argument from Payload config
 * - `src/migrations`
 * - `dist/migrations`
 * - `migrations`
 *
 * Defaults to `src/migrations`
 *
 * @param migrationDir
 * @returns
 */
function findMigrationDir(migrationDir?: string): string {
  const cwd = process.cwd()
  const srcDir = path.resolve(cwd, 'src/migrations')
  const distDir = path.resolve(cwd, 'dist/migrations')
  const relativeMigrations = path.resolve(cwd, 'migrations')

  // Use arg if provided
  if (migrationDir) return migrationDir

  // Check other common locations
  if (fs.existsSync(srcDir)) {
    return srcDir
  }

  if (fs.existsSync(distDir)) {
    return distDir
  }

  if (fs.existsSync(relativeMigrations)) {
    return relativeMigrations
  }

  return srcDir
}
