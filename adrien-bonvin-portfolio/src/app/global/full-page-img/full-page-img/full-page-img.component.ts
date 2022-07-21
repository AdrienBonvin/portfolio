import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-full-page-img',
  templateUrl: './full-page-img.component.html',
  styleUrls: ['./full-page-img.component.css']
})
export class FullPageImgComponent {

  @Input() mainText!:string;
  @Input() secondaryText!:string;
  @Input() sideText!:string;

  hamburger="Hamburger.";
  tailleEcran!:string;
  intervalId!: NodeJS.Timeout;

  constructor() { }
  ngOnInit(){
    if (window.innerWidth < 1000) {
      this.intervalId = setInterval(() => {
        this.changeHamburgerText()
      }, 2000);
    }
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  changeHamburgerText(){
    if(this.hamburger == 'Hamburger.') {
      this.hamburger = 'Website.'
    } else {
      this.hamburger = 'Hamburger.'
    }
  }
}

