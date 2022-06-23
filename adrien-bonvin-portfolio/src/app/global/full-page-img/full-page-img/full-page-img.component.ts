import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-full-page-img',
  templateUrl: './full-page-img.component.html',
  styleUrls: ['./full-page-img.component.css']
})
export class FullPageImgComponent implements OnInit {

  @Input() mainText!:string;
  @Input() secondaryText!:string;

  tailleEcran!:string;

  constructor() { }

  ngOnInit(): void {
    this.tailleEcran = window.innerHeight + 'px';
  }

}
