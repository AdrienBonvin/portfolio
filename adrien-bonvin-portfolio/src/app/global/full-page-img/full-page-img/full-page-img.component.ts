import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-full-page-img',
  templateUrl: './full-page-img.component.html',
  styleUrls: ['./full-page-img.component.css']
})
export class FullPageImgComponent {

  @Input() mainText!:string;
  @Input() secondaryText!:string;

  hamburger="Hamburger.";
  tailleEcran!:string;

  constructor() { }

}
