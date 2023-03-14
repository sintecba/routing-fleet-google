/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors } from '@angular/forms';
import { MatDialogRef, MatDialogState } from '@angular/material/dialog';
import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { merge } from 'lodash';

import * as fromRoot from 'src/app/reducers';
import { MessagesConfig, Scenario, ScenarioSolutionPair, Solution } from '../../models';
import { UploadType } from '../../models/upload';
import { IWaypoint } from '../../models/dispatcher.model';
import * as fromConfig from '../../selectors/config.selectors';
import { DispatcherService, FileService, PlacesService, UploadService } from '../../services';
import { toDispatcherLatLng } from 'src/app/util';

///////////////////////////////////////////////////////////////////////////////
import * as xlsx from 'xlsx';
import * as _ from 'lodash';
///////////////////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-upload-dialog',
  templateUrl: './upload-dialog.component.html',
  styleUrls: ['./upload-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class UploadDialogComponent {
  @ViewChild('fileInput', { static: true }) fileInput: ElementRef<HTMLInputElement>;

  readonly form: FormGroup;
  readonly fileName: FormControl;
  fileInvalid: boolean;
  validatingUpload: boolean;
  private json: any;
  private _scenario: Scenario;
  private get scenario(): Scenario {
    return this._scenario || this.scenarioSolutionPair?.scenario;
  }
  private set scenario(value: Scenario) {
    this._scenario = value;
  }
  private scenarioSolutionPair: ScenarioSolutionPair;
  zipContentsInvalid: boolean;

  resolvingPlaceIds = false;
  placeIdProgress = 0;
  placeIdError: string;
  get placeIdCount(): number {
    return this.scenarioWaypointsWithPlaceIDs.length;
  }

  readonly messages$: Observable<MessagesConfig>;

  constructor(
    private store: Store<fromRoot.State>,
    private dialogRef: MatDialogRef<UploadDialogComponent>,
    private dispatcherService: DispatcherService,
    private fileService: FileService,
    private placesService: PlacesService,
    private uploadService: UploadService,
    fb: FormBuilder
  ) {
    this.form = fb.group({
      fileName: (this.fileName = fb.control('', [this.fileValidator.bind(this)])),
    });
    this.messages$ = this.store.pipe(select(fromConfig.selectMessagesConfig));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  solve(): void {
    this.dialogRef.close({
      uploadType: this.scenarioSolutionPair ? UploadType.ScenarioSolutionPair : UploadType.Scenario,
      content: this.scenarioSolutionPair ? this.scenarioSolutionPair : this.scenario,
    });
  }

  selectFile(): void {
    if (!this.fileInput) {
      return;
    }
    this.fileInput.nativeElement.click();
    this.fileName.markAsTouched();
  }

  fileUploadClicked(e: MouseEvent): void {
    (e.target as HTMLInputElement).value = null;
  }

  async fileSelected(e: Event): Promise<void> {
    const target = e.target as HTMLInputElement;
    const file = target && target.files && target.files[0];
    if (!file) {
      return;
    }
    this.validatingUpload = true;
    //////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////
    // PERFORM TRANSLATION FROM XLSX TO JSON
    // Read file input
    function readFile(file: File): Promise<xlsx.WorkBook> {
      return new Promise<xlsx.WorkBook>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = xlsx.read(buffer, { type: 'array' });
          resolve(workbook);
        };
        reader.onerror = (e) => {
          reject(e);
        };
        reader.readAsArrayBuffer(file);
      });
    }
    this.fileInvalid = false;
    try {
      const workbook    = await readFile(file);
      const ubicaciones = workbook.Sheets['Ubicaciones'];
      const shipments   = workbook.Sheets['Shipments'];
      const tw          = workbook.Sheets['TimeWindows'];
      const unidades    = workbook.Sheets['Unidades'];
      const modelo      = workbook.Sheets['Modelo'];
      const shipmentsColumns = Object.keys(shipments).slice(1);
      const shipments_all = _.merge(shipmentsColumns, 
                                    ubicaciones, 
                                    { 
                                      leftOn: 'id_ubicacion', 
                                      rightOn: 'id' 
                                    });
      // const columnNames = _.keys(shipments_all);
      const json_parsed = {
        "model": {
          "global_start_time": modelo.global_start[0],
          "global_end_time": modelo.global_end[0],
          "shipments": shipments_all.map((shipment) => ({
            "demands": [
              {
                "type": "weight_kilograms",
                "value": String((shipment as any)['demanda']),
              },
            ],
            "deliveries": [
              {
                "arrivalLocation": {
                  "latitude": (shipment as any)['latitude'],
                  "longitude": (shipment as any)['longitude'],
                },
                "timeWindows": tw
                  .filter((tw: any) => (tw as any).id_shipment === (shipment as any).id)
                  .map((tw: any) => ({
                    "start_time": (tw as any).start_time_window,
                    "end_time": (tw as any).end_time_window,
                  })),
                "duration": {
                  "seconds": (shipment as any).time_service,
                },
              },
            ],
          })),
          "vehicles": unidades.map((unidad) => ({
            "startLocation": {
              "latitude": (unidad as any).latitude_salida,
              "longitude": (unidad as any).longitude_salida,
            },
            "endLocation": {
              "latitude": (unidad as any).latitude_llegada,
              "longitude": (unidad as any).longitude_llegada,
            },
            "capacities": [
              {
                "type": "weight_kilograms",
                "value": String((unidad as any).capacidad_peso),
              },
            ],
            "costPerHour": (unidad as any).costo_hora,
            "costPerKilometer": (unidad as any).costo_km,
          })),
        },
      };
      // const json = JSON.stringify(json_parsed)
      let json: any = null;
      json = JSON.parse(String(json_parsed));
    } catch (error) {
      console.log(`\n\n=== ERROR:\n\t${error}\n`)
      this.fileInvalid = true;
    }
    //////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////

    // // First check if the file is valid JSON
    // let json: any = null;
    // this.fileInvalid = false;
    // try {
    //   const text = await this.fileService.readAsText(file);
    //   json = JSON.parse(text);
    // } catch (error) {
    //   this.fileInvalid = true;
    //   json = null;
    // }
    // try {
    //     await this.fileService.unzip(file);
    //     fileIsZip = true;
    //     const files = await this.fileService.getJSONFromZip(file);
    //     this.scenarioSolutionPair = this.loadZipContents(files);
    // } catch (err) {
    //     if (fileIsZip) {
    //       this.zipContentsInvalid = true;
    //     } else {
    //       this.fileInvalid = true;
    //     }
    // }
    this.validatingUpload = false;
    this.fileName.setValue(file.name);
  }

  get scenarioHasPlaceIds(): boolean {
    return this.scenarioWaypointsWithPlaceIDs.length > 0;
  }

  private get scenarioWaypoints(): IWaypoint[] {
    return [
      this.scenario?.model?.shipments?.flatMap((shipment) =>
        shipment.pickups
          ?.flatMap((pickup) => [pickup.arrivalWaypoint, pickup.departureWaypoint])
          .concat(
            shipment.deliveries?.flatMap((delivery) => [
              delivery.arrivalWaypoint,
              delivery.departureWaypoint,
            ])
          )
      ),
      this.scenario?.model?.vehicles?.flatMap((vehicle) => [
        vehicle.startWaypoint,
        vehicle.endWaypoint,
      ]),
    ]
      .flat()
      .filter((waypoint) => !!waypoint);
  }

  private get scenarioWaypointsWithPlaceIDs(): IWaypoint[] {
    return this.scenarioWaypoints.filter((waypoint) => !!waypoint.placeId);
  }

  private resetResolvingPlaceIds(): void {
    this.placeIdProgress = 0;
    this.resolvingPlaceIds = false;
  }

  /**
   * For all waypoints in the `scenario` with Place IDs,
   * set the lat/lng location of the waypoint
   * from a Place Details request.
   */
  async resolveWaypointPlaceIds(): Promise<void> {
    if (this.scenarioHasPlaceIds) {
      this.resolvingPlaceIds = true;
      this.placeIdProgress = 0;
      this.placeIdError = null;

      for (const waypoint of this.scenarioWaypointsWithPlaceIDs) {
        // stop if the user has clicked the cancel button
        if (this.dialogRef.getState() === MatDialogState.CLOSED) {
          this.resetResolvingPlaceIds();
          break;
        }

        try {
          const placeResult = await this.placesService.getDetails(waypoint.placeId);

          waypoint.location = merge(waypoint.location, {
            latLng: toDispatcherLatLng(placeResult.geometry.location),
          });

          this.placeIdProgress++;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(err);
          this.placeIdError = `Place ID lookup failed: ${err}`;
          this.resetResolvingPlaceIds();
          break;
        }
      }

      this.resolvingPlaceIds = false;
    }
  }

  fileValidator(control: FormControl): ValidationErrors | null {
    if (this.fileInvalid) {
      return { fileFormat: true };
    }
    if (this.zipContentsInvalid) {
      return { zipContents: true };
    }
    if (!(typeof control.value === 'string') || control.value.trim().length === 0) {
      return { required: true };
    }
    if (this.json) {
      return this.scenarioValidator(control);
    }
  }

  loadZipContents(files: { content: JSON; filename: string }[]): ScenarioSolutionPair {
    if (files.length !== 2) {
      throw new Error('Incorrect number of files');
    }

    let scenario;
    let solution;
    files.forEach((file) => {
      if (file.filename === 'scenario.json') {
        scenario = this.validateScenario(file.content);
      }
      if (file.filename === 'solution.json') {
        solution = this.validateSolution(file.content);
      }
    });

    if (!scenario) {
      throw new Error('Missing scenario.json');
    }

    if (!solution) {
      throw new Error('Missing solution.json');
    }

    return { scenario, solution };
  }

  /**
   * Returns scenario validation errors
   *
   * @remarks
   * Only validates the message/value structure
   */
  scenarioValidator(_: FormControl): ValidationErrors | null {
    try {
      const scenario = this.validateScenario(this.json);

      if (this.scenario == null) {
        this.scenario = scenario;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Invalid request format:', error);
      return { requestFormat: true };
    }
    return null;
  }

  validateScenario(json: any): Scenario {
    const validationResult = this.uploadService.validateScenarioFormat(json);
    if (validationResult) {
      throw validationResult;
    }

    return this.dispatcherService.objectToScenario(json);
  }

  validateSolution(json: any): Solution {
    const validationResult = this.uploadService.validateSolutionFormat(json);
    if (validationResult) {
      throw validationResult;
    }

    return this.dispatcherService.objectToSolution(json);
  }
}
