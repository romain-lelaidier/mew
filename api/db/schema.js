import { mysqlTable, primaryKey, int, varchar, datetime, timestamp } from "drizzle-orm/mysql-core"

export const players = mysqlTable(
  'players',
  {
    pid: varchar({ length: 8 }).notNull(),
    plg: varchar({ length: 5 }).notNull(),
    sts: int(),
    sfc: varchar({ length: 2048 }),
    nfc: varchar({ length: 8192 }),
  },
  table => [
    primaryKey({ columns: [ table.pid, table.plg ] })
  ]
);

export const palettes = mysqlTable(
  'palettes',
  {
    id: varchar({ length: 17 }).notNull().primaryKey(),
    p: varchar({ length: 256 }).notNull()
  }
);

export const logs = mysqlTable(
  'logs',
  {
    id: int().primaryKey().autoincrement(),
    date: timestamp().defaultNow(),
    ip: varchar({ length: 32 }),
    type: varchar({ length: 8 }),
    vid: varchar({ length: 11 }),
    name: varchar({ length: 128 }),
    subname: varchar({ length: 128 })
  }
);

export const songs = mysqlTable(
  'songs',
  {
    id: varchar({ length: 11 }).notNull().primaryKey(),
    title: varchar({ length: 128 }),
    artist: varchar({ length: 128 }),
    artistId: varchar({ length: 32 }),
    album: varchar({ length: 128 }),
    albumId: varchar({ length: 32 }),
    thumbnail: varchar({ length: 256 })
  }
);

export const playlists = mysqlTable(
  'playlists',
  {
    id: varchar({ length: 32 }).notNull().primaryKey(),
    name: varchar({ length: 128 }),
    created: timestamp().defaultNow(),
    modified: timestamp().defaultNow()
  }
);

export const playlistSongs = mysqlTable(
  'playlistsongs',
  {
    pid: varchar({ length: 32 }).notNull().references(() => playlists.id),
    sid: varchar({ length: 11 }).notNull().references(() => songs.id),
    added: timestamp().defaultNow()
  },
  table => [
    primaryKey({ columns: [ table.pid, table.sid ] })
  ]
);

export const users = mysqlTable(
  'users',
  {
    id: int().notNull().autoincrement().primaryKey(),
    name: varchar({ length: 128 }).notNull(),
    hash: varchar({ length: 60 }).notNull()
  }
);

export const userPlaylists = mysqlTable(
  'userplaylists',
  {
    uid: int().notNull().references(() => users.id),
    pid: varchar({ length: 32 }).notNull().references(() => playlists.id)
  },
  table => [
    primaryKey({ columns: [ table.uid, table.pid ] })
  ]
);