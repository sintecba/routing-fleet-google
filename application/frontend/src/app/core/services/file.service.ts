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

//   async getVehiclesFromXlsx(xlsx_file: File): Promise<any> {
//     const fileContents: ArrayBuffer = await new Promise((resolve) => {
//       const reader = new FileReader();
//       reader.onload = () => {
//         resolve(reader.result as ArrayBuffer);
//       };
//       reader.readAsArrayBuffer(xlsx_file);
//     });
//     const file = XLSX.read(fileContents);
//     let data = {};
//     const sheets = file.SheetNames;
//     for(let i = 0; i < sheets.length; i++) {
//         const worksheetName = sheets[i];
//         data[worksheetName] = [];
//         const rows = XLSX.utils.sheet_to_json(file.Sheets[worksheetName]);
//         rows.forEach( (row) => {
//             data[worksheetName].push(row);
//         });
//     }

//     const data_vehicles = {
//       "vehicles": data['Unidades'].map((item_unidades: { tipo: any; }) => {
//         return {
//           "vehicles_type": item_unidades.tipo,
//           };
//       }),
//     }
//     return { data_vehicles, };
//   }
// }

  async getVehiclesFromXlsx(xlsx_file: File): Promise<any> {
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

    // Parsear el archivo XLSX
    for(let i = 0; i < sheets.length; i++) {
        const worksheetName = sheets[i];
        data[worksheetName] = [];
        const rows = XLSX.utils.sheet_to_json(file.Sheets[worksheetName]);
        rows.forEach( (row) => {
            data[worksheetName].push(row);
        });
    }

    const data_vehicles = {
      "vehicles": data['Unidades'].map((item_unidades: { tipo: any; }) => {
        return {
          "vehicles_type": item_unidades.tipo,
          };
      }),
    }
    return { data_vehicles, hasHeavyVehicle };
  }
}
