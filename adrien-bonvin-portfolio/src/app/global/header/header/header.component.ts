import { Component, ElementRef, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  hauteurEcran!: number;
  pathLogo_light: string = "../../../../assets/pictures/general/logo.png";
  pathLogo_dark: string = "../../../../assets/pictures/general/logo_dark.png";
  pathLogo: string = this.pathLogo_light;
  fontColor_light: string = "white";
  fontColor_dark: string = "black";
  fontColor: string = this.fontColor_light;
  buttonType: string = "blue-button"

  constructor(private el: ElementRef) { }

  @HostListener('window:scroll', [])
  scroll(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    let scrollHeight = window.scrollY - window.innerHeight;

    //Lorsque l'écran hero arrive 50px avant le haut de l'écran, le logo change
    if (scrollHeight > 10150){
      this.pathLogo = this.pathLogo_light;
      this.fontColor = this.fontColor_light;
      this.buttonType = "white-button";
    } else if (Math.abs(rect.bottom) > this.hauteurEcran -50) {
      this.pathLogo = this.pathLogo_dark;
      this.fontColor = this.fontColor_dark;
      this.buttonType = "blue-button";
    } else {
      this.pathLogo = this.pathLogo_light;
      this.fontColor = this.fontColor_light
    }
  }

  ngOnInit(): void {
    this.hauteurEcran = window.innerHeight;
  }
}
