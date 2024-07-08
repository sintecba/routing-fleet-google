/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { ITimeWindow, VisitRequest } from 'src/app/core/models';
import { DataSource } from 'src/app/shared/models';
import { ShipmentItem } from '../../models';
import { durationMinutesSeconds, pad } from '../../../util/duration';

@Component({
  selector: 'app-base-shipments-table',
  templateUrl: './base-shipments-table.component.html',
  styleUrls: ['./base-shipments-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BaseShipmentsTableComponent {
  @Input() dataSource: DataSource<ShipmentItem>;
  @Input() sort?: { active: string; direction: string };
  @Input() itemsSelected: { [shipmentId: number]: boolean } = {};
  @Input() demandTypes: string[];
  @Input() columnsToDisplay: string[];
  @Input() totalShipments = 0;
  @Input() duration: [Long, Long];
  @Input() relativeTo: Long;
  @Input() unitAbbreviations: { [unit: string]: string };
  @Input() timezoneOffset = 0;
  @Input() changeDisabled = false;
  @Input() hasMap = false;
  @Output() selectAll = new EventEmitter<void>();
  @Output() deselectAll = new EventEmitter<void>();
  @Output() selectedChange = new EventEmitter<{ id: number; selected: boolean }>();
  @Output() sortChange = new EventEmitter<{ active: string; direction: string }>();
  @Output() add = new EventEmitter();
  @Output() edit = new EventEmitter<number>();
  @Output() delete = new EventEmitter<ShipmentItem>();
  @Output() mouseEnterVisitRequest = new EventEmitter<number>();
  @Output() mouseExitVisitRequest = new EventEmitter<number>();

  
  constructor(private zone: NgZone) {}
  
  idSelector(item: ShipmentItem): number {    
    return item.visitRequest.id;
  }

  selectedIdSelector(item: ShipmentItem): number {
    return item.shipment.id;
  }

  canSelect(item: ShipmentItem): boolean {
    return item.first;
  }

  findVisitRequestTimeWindow(visitRequest: VisitRequest): ITimeWindow {
    return visitRequest?.timeWindows?.[0];
  }

  editLabel(item: ShipmentItem): string {
    return `Edit shipment ${item.shipment.label || '#' + item.shipment.id}`;
  }

  deleteLabel(item: ShipmentItem): string {
    return `Delete shipment ${item.shipment.label || '#' + item.shipment.id}`;
  }

  onSelectionChange(value?: { id: number; selected: boolean }): void {
    this.zone.run(() => this.selectedChange.emit(value));
  }

  onDeselectAll(): void {
    this.zone.run(() => this.deselectAll.emit());
  }

  onSelectAll(): void {
    this.zone.run(() => this.selectAll.emit());
  }

  onSortChange(value: { active: string; direction: string }): void {
    this.zone.run(() => this.sortChange.emit(value));
  }

  onEdit(shipmentId: number): void {
    this.zone.run(() => this.edit.emit(shipmentId));
  }

  onDelete(item: ShipmentItem): void {
    this.zone.run(() => this.delete.emit(item));
  }

  onMouseEnterRow(item: ShipmentItem): void {
    this.mouseEnterVisitRequest.emit(item.visitRequest.id);
  }

  onMouseExitRow(item: ShipmentItem): void {
    this.mouseExitVisitRequest.emit(item.visitRequest.id);
  }

  secondsToFormattedTime(duration): string {
    const durationMinSec: { minutes: number; seconds: number } = durationMinutesSeconds(duration);
    return pad(durationMinSec.minutes.toString()) + ':' + pad(durationMinSec.seconds.toString());
  }
}
