/**
 * Per-project material stock balance + delivery log.
 *
 * material_stock tracks running balance per (project_id, material_code):
 *   qty_ordered (PO) → qty_received (delivered) → qty_used (consumed on site)
 *   balance = qty_received - qty_used
 *
 * material_delivery records each delivery event (one DO/surat jalan = one row).
 * On insert, material_stock.qty_received is atomically incremented in the same tx.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { project } from './project';
import { resourceMaster } from './resource-master';
import { user } from './tenancy';

export const materialStock = pgTable('material_stock', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  resourceMasterId: uuid('resource_master_id').references(() => resourceMaster.id, { onDelete: 'set null' }),
  materialCode: varchar('material_code', { length: 64 }).notNull(),
  materialName: text('material_name').notNull(),
  satuan: varchar('satuan', { length: 16 }).notNull(),
  qtyOrdered: numeric('qty_ordered', { precision: 18, scale: 4 }).notNull().default('0'),
  qtyReceived: numeric('qty_received', { precision: 18, scale: 4 }).notNull().default('0'),
  qtyUsed: numeric('qty_used', { precision: 18, scale: 4 }).notNull().default('0'),
  supplier: varchar('supplier', { length: 160 }),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('material_stock_unique').on(t.projectId, t.materialCode),
  index('material_stock_project').on(t.projectId),
]);

export const materialDelivery = pgTable('material_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  stockId: uuid('stock_id').references(() => materialStock.id, { onDelete: 'set null' }),
  deliveryDate: date('delivery_date').notNull(),
  doNumber: varchar('do_number', { length: 64 }),
  materialCode: varchar('material_code', { length: 64 }).notNull(),
  qty: numeric('qty', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }),
  supplier: varchar('supplier', { length: 160 }),
  vehiclePlate: varchar('vehicle_plate', { length: 32 }),
  driverName: varchar('driver_name', { length: 120 }),
  signedBy: varchar('signed_by', { length: 120 }),
  notes: text('notes'),
  recordedById: uuid('recorded_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('material_delivery_project_date').on(t.projectId, t.deliveryDate),
]);

export type MaterialStock = typeof materialStock.$inferSelect;
export type NewMaterialStock = typeof materialStock.$inferInsert;
export type MaterialDelivery = typeof materialDelivery.$inferSelect;
export type NewMaterialDelivery = typeof materialDelivery.$inferInsert;
