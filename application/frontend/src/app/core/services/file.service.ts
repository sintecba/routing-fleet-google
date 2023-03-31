/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { Injectable, RendererFactory2 } from '@angular/core';
import { from, Observable } from 'rxjs';
import * as jszip from 'jszip';

// import { readFile, utils } from 'xlsx';
// const { readFile, utils } = pkg;
// import * as fs from 'fs';
import * as XLSX from 'xlsx';

type FileData = string | number[] | Uint8Array | ArrayBuffer | Blob;

/**
 * Responsible for file operations
 */
@Injectable({
  providedIn: 'root',
})
export class FileService {
  constructor(private rendererFactory: RendererFactory2) {}

  /**
   * Downloads to a file
   * @param name name to give the file
   * @param data data to put in the file
   * @param type MIME type of the file
   */
  download(name: string, data: BlobPart[], type = ''): void {
    const blob = new Blob(data, { type });
    const url = URL.createObjectURL(blob);
    const renderer = this.rendererFactory.createRenderer(null, null);
    const a: HTMLAnchorElement = renderer.createElement('a');
    a.style.display = 'none';
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  readAsText(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Creates a zip file
   */
  zip(files: { [fileName: string]: FileData }): Observable<Blob> {
    const zip = new jszip();
    Object.keys(files || {}).forEach((name) => {
      zip.file(name, files[name]);
    });
    return from(zip.generateAsync({ type: 'blob' }));
  }

  /**
   * Unzips a file
   */
  unzip(file: Blob): Promise<jszip> {
    const zip = new jszip();
    return zip.loadAsync(file);
  }

  async getJSONFromZip(file: Blob): Promise<any> {
    const zip = new jszip();
    const contents = await zip.loadAsync(file);

    const results = [];
    for (const filename of Object.keys(contents.files)) {
      const rootFilename = filename.replace(/^.*[\\/]/, '');
      if (
        contents.files[filename].dir ||
        (rootFilename !== 'scenario.json' && rootFilename !== 'solution.json')
      ) {
        continue;
      }

      results.push(
        await zip
          .file(filename)
          .async('text')
          .then((content) => ({ filename: rootFilename, content: JSON.parse(content) }))
      );
    }
    return results;
  }

  ////////////////////////////////////////////////////////////////////
  // sintec
  ////////////////////////////////////////////////////////////////////
  async getModelFromXlsx(xlsx_file: File): Promise<any> {
    const fileContents: ArrayBuffer = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(xlsx_file);
    });
    const file = XLSX.read(fileContents);
    let data = {};
    const sheets = file.SheetNames;
    for(let i = 0; i < sheets.length; i++) {
        const worksheetName = sheets[i];
        data[worksheetName] = [];
        const rows = XLSX.utils.sheet_to_json(file.Sheets[worksheetName]);
        rows.forEach( (row) => {
            data[worksheetName].push(row);
        });
    }
    const model = {
      "global_start_time": data['Modelo'][0]['global_start'],
      "global_end_time": data['Modelo'][0]['global_end'],
      "shipments": data['Shipments'].map((item_shipment) => {
        return {
          "demands": [
            {
              "type": 'weight_kilograms',
              "value": String(item_shipment.demanda),
            },
          ],
          "deliveries": [
            {
              "arrivalLocation": {
                "latitude": data['Ubicaciones'][item_shipment.id]['latitude'],
                "longitude": data['Ubicaciones'][item_shipment.id]['longitude'],
              },
              "timeWindows": data['TimeWindows']
                .filter((item) => item.id_shipment === item_shipment.id)
                .map((item) => {
                  return {
                    "start_time": item.start_time_window,
                    "end_time": item.end_time_window,
                  };
                }),
              "duration": {
                "seconds": item_shipment.time_service,
              },
            },
          ],
        };
      }),
      "vehicles": data['Unidades'].map((item_unidades) => {
        return {
          "startLocation": {
            "latitude": item_unidades.latitude_salida,
            "longitude": item_unidades.longitude_salida,
          },
          "endLocation": {
            "latitude": item_unidades.latitude_llegada,
            "longitude": item_unidades.longitude_llegada,
          },
          "capacities": [
              {
                "type": 'weight_kilograms',
                "value": String(item_unidades.capacidad_peso),
              },
          ],
          "costPerHour": item_unidades.costo_hora,
          "costPerKilometer": item_unidades.costo_km,
        };
      }),
    }
    return { model, };
  }

  async getHeavyVehicleFlag(xlsx_file: File): Promise<any> {
    const fileContents: ArrayBuffer = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(xlsx_file);
    });
    const file = XLSX.read(fileContents);
    // Comprobar si hay un vehículo pesado en la hoja "Unidades"
    let hasHeavyVehicle = false;
    const unidadesSheet = file.Sheets['Unidades'];
    const rows = XLSX.utils.sheet_to_json(unidadesSheet);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]['tipo'] === 'pesado') {
        hasHeavyVehicle = true;
        break;
      }
    }
    return { hasHeavyVehicle, };
  }

  async getHeavyModel(xlsx_file: File): Promise<any> {
    const fileContents: ArrayBuffer = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.readAsArrayBuffer(xlsx_file);
    });
    ///////////////////////////////////////////////////////////////////////////
    const file = XLSX.read(fileContents);
    const { ubicacionesPoints, salidasPoints, llegadasPoints, } = this.getPointsFromXLSX(file);
    const ORIGINS = ubicacionesPoints.concat(salidasPoints);
    const DESTINATIONS = ubicacionesPoints.concat(llegadasPoints);
    const ROWS = this.getUniquePoints(ORIGINS);
    const COLS = this.getUniquePoints(DESTINATIONS);
    const N = ROWS.length;
    const M = COLS.length;
    console.log(`\n === CHECPOINT 1 === \n ${N} \n ${M}`);
    const DATA = await this.getResponse(ROWS, COLS);
    console.log(`\n === CHECPOINT 2 === \n ${Object.keys(DATA)}`);
    const duration_distance_matrices = this.getDurationsDistances(DATA, N, M);
    const duration_distance_matrix_src_tags = this.getDurationDistanceSrcTags(DATA);
    const duration_distance_matrix_dst_tags = this.getDurationDistanceDstTags(DATA);
    const extra_model = { duration_distance_matrices, duration_distance_matrix_src_tags, duration_distance_matrix_dst_tags};
    ///////////////////////////////////////////////////////////////////////////
    const simpleModel = this.getSimpleModel(fileContents);
    const model = { ...simpleModel, ...extra_model };
    return model;
  }

  getPointsFromXLSX(file: XLSX.WorkBook) {
    const ubicacionesSheet = file.Sheets['Ubicaciones'];
    const unidadesSheet = file.Sheets['Unidades'];
    const ubicacionesPoints = XLSX.utils.sheet_to_json(ubicacionesSheet, {
      header: 1,
      range: 'B2:C7',
    }).map(row => ({lat: row[0], lng: row[1]}));
    const salidasPoints = XLSX.utils.sheet_to_json(unidadesSheet, {
      header: 1,
      range: 'I2:J5',
    }).map(row => ({lat: row[0], lng: row[1]}));
    const llegadasPoints = XLSX.utils.sheet_to_json(unidadesSheet, {
      header: 1,
      range: 'K2:L5', 
    }).map(row => ({ lat: row[0], lng: row[1] }));
    return { ubicacionesPoints, salidasPoints, llegadasPoints, }
  }

  getUniquePoints(points: { lat: any; lng: any; }[]) {
    const uniquePoints = [];
    const uniquePointMap = new Map();
    for (const point of points) {
        const pointStr = `${point.lat},${point.lng}`;
        if (!uniquePointMap.has(pointStr)) {
            uniquePointMap.set(pointStr, point);
            uniquePoints.push(point);
        }
    }
    return uniquePoints;
  }

  setURL(apiKey: string, origins: any[], destinations: any[]) {
    const baseUrl = "https://api.distancematrix.ai/maps/api/distancematrix/json";
    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join("|");
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join("|");
    const url = `${baseUrl}?origins=${originsStr}&destinations=${destinationsStr}&key=${apiKey}`;
    return url;
  }

  async getResponse(origins: any[], destinations: any[]) {
    const apiKey = 'cjL3fE8miH1aBDLJekRvesktJqyuX';
    const url = this.setURL(apiKey, origins, destinations);
    const response = await fetch(url);
    const data = await response.json();
    return data;
  }

  getDurationsDistances(data, n: number, m: number) {
    const rows = [];
    for (let i = 0; i < n; i++) {
        const row = data.rows[i].elements;
        const durations = [];
        const meters = [];
        for (let j = 0; j < m; j++) {
            const element = row[j];
            if (element.distance && element.distance.value) {
                meters[j] = element.distance.value;
            } else {
                meters[j] = 0;
            }
            if (element.duration && element.duration.value) {
                durations[j] = element.duration.value;
            } else {
                durations[j] = 0;
            }
        }
        rows[i] = { durations, meters };
    }
    const duration_distance_matrices = [{ rows }];
    return duration_distance_matrices; 
  }

  getDurationDistanceSrcTags(data) {
    const duration_distance_matrix_src_tags = [ data.origin_addresses ]
    return duration_distance_matrix_src_tags;
  }

  getDurationDistanceDstTags(data) {
    const duration_distance_matrix_dst_tags = [ data.destination_addresses ]
    return duration_distance_matrix_dst_tags;
  }

  getSimpleModel(fileContents: any) {
    const file = XLSX.read(fileContents);
    let data = {};
    const sheets = file.SheetNames;
    for(let i = 0; i < sheets.length; i++) {
        const worksheetName = sheets[i];
        data[worksheetName] = [];
        const rows = XLSX.utils.sheet_to_json(file.Sheets[worksheetName]);
        rows.forEach( (row) => {
            data[worksheetName].push(row);
        });
    }
    const model = {
      "global_start_time": data['Modelo'][0]['global_start'],
      "global_end_time": data['Modelo'][0]['global_end'],
      "shipments": data['Shipments'].map((item_shipment) => {
        return {
          "demands": [
            {
              "type": 'weight_kilograms',
              "value": String(item_shipment.demanda),
            },
          ],
          "deliveries": [
            {
              "arrivalLocation": {
                "latitude": data['Ubicaciones'][item_shipment.id]['latitude'],
                "longitude": data['Ubicaciones'][item_shipment.id]['longitude'],
              },
              "timeWindows": data['TimeWindows']
                .filter((item) => item.id_shipment === item_shipment.id)
                .map((item) => {
                  return {
                    "start_time": item.start_time_window,
                    "end_time": item.end_time_window,
                  };
                }),
              "duration": {
                "seconds": item_shipment.time_service,
              },
            },
          ],
        };
      }),
      "vehicles": data['Unidades'].map((item_unidades) => {
        return {
          "startLocation": {
            "latitude": item_unidades.latitude_salida,
            "longitude": item_unidades.longitude_salida,
          },
          "endLocation": {
            "latitude": item_unidades.latitude_llegada,
            "longitude": item_unidades.longitude_llegada,
          },
          "capacities": [
              {
                "type": 'weight_kilograms',
                "value": String(item_unidades.capacidad_peso),
              },
          ],
          "costPerHour": item_unidades.costo_hora,
          "costPerKilometer": item_unidades.costo_km,
        };
      }),
    }
    return { model, };
  }

}

