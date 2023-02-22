//Create a pipe class that gives back the content of a variable depending on the variable on which the pipe is applied.

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'frText'
})
export class FrTextPipe implements PipeTransform {
  transform(value: any, ...args: any[]): any {
    return FrText.frText.find((element) => element.id === value)?.frText;
  }
}

export class FrText {
  static frText: frElement[] = [
    {
      id: 'heroTitle',
      frText: 'Accueil',
      enText: 'Home'
    },
    {
      id: 'heroSubtitle',
      frText: 'À propos',
      enText: 'About'
    }
  ];
}

export interface frElement {
  id: string;
  frText: string;
  enText: string;
}

