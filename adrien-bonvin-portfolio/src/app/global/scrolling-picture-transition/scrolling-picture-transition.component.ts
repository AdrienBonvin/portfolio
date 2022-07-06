import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { NumberValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-scrolling-picture-transition',
  templateUrl: './scrolling-picture-transition.component.html',
  styleUrls: ['./scrolling-picture-transition.component.scss']
})
export class ScrollingPictureTransitionComponent implements OnInit {
  delay!: string;
  opacityMainText: number = 0;
  hamburger="Hamburger";

  showBottomBunText: boolean = false;

  animationDelayBottomBun = this.delay;
  animationDelaySteak = this.delay;
  animationDelayCheese = this.delay;
  animationDelayPickles = this.delay;
  animationDelayOignons = this.delay;
  animationDelayTomatoes = this.delay;
  animationDelaySalad = this.delay;
  animationDelayTopBun = this.delay;

  // Visibilité des encadrés descriptifs des ingrédients
  showDevopsText = false;
  showFrontendText = false;
  showBackendText = false;
  showCustomerserviceText = false;
  showApiText = false;
  showGraphicdesignText = false;
  showSocialText = false;
  showUiuxText = false;

  initialCount = 0;

  constructor(private el: ElementRef) { }

  @HostListener('window:scroll', [])
  scroll(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    let scrollHeight = window.scrollY - window.innerHeight;
    let animationTimeStamp = scrollHeight/1000;

    this.animationDelayBottomBun = this.setAnimation(animationTimeStamp, this.initialCount+1);

    this.animationDelaySteak = this.setAnimation(animationTimeStamp, this.initialCount+2);

    this.animationDelayCheese = this.setAnimation(animationTimeStamp, this.initialCount+3);

    this.animationDelayPickles = this.setAnimation(animationTimeStamp, this.initialCount+4);

    this.animationDelayOignons = this.setAnimation(animationTimeStamp, this.initialCount+5);

    this.animationDelayTomatoes = this.setAnimation(animationTimeStamp, this.initialCount+6);

    this.animationDelaySalad = this.setAnimation(animationTimeStamp, this.initialCount+7);

    this.animationDelayTopBun = this.setAnimation(animationTimeStamp, this.initialCount+8);

    this.opacityMainText = (animationTimeStamp)>0 && (animationTimeStamp)<1 ? animationTimeStamp*2 : 0;
    if (scrollHeight> 10050) {
      this.isAllTextVisible(false);
    }
    else if (scrollHeight> 9950) {
      this.showCustomerserviceText = false;
      this.showGraphicdesignText = false;
    }
    else if (scrollHeight> 9800) {
      this.showBackendText = false;
      this.showApiText = false;
    }
    else if (scrollHeight> 9700) {
      this.showDevopsText = false;
      this.showFrontendText = false;
    } else if (scrollHeight> 8500) {
      this.isAllTextVisible(true);
    } else if (scrollHeight> 7500) {
      this.showUiuxText = false;
      this.showSocialText = true;
    } else if (scrollHeight> 6500) {
      this.showSocialText = false;
      this.showCustomerserviceText = true;
    } else if (scrollHeight> 5500) {
      this.showCustomerserviceText = false;
      this.showGraphicdesignText = true;
    } else if (scrollHeight> 4500) {
      this.showGraphicdesignText = false;
      this.showApiText = true;
    } else if (scrollHeight> 3500) {
      this.showApiText = false;
      this.showBackendText = true;
    } else if (scrollHeight> 2500) {
      this.showBackendText = false;
      this.showFrontendText = true;
    } else if (scrollHeight> 1500) {
      this.showFrontendText = false;
      this.showDevopsText = true;
    } else {
      this.showDevopsText = false;
    }
  }

  ngOnInit(): void {
  }

  setAnimationTimestamp(timeStamp: number, delay: number):string {
    return ('-'+(timeStamp-delay).toFixed(2)+'s');
  }
  setAnimation(animationTimestamp:number, delay:number):string {
    return (animationTimestamp-delay)>0 ? (this.setAnimationTimestamp(animationTimestamp, delay)) : '0s';
  }

  isAllTextVisible(visible:boolean){
    this.showDevopsText = visible;
    this.showFrontendText = visible;
    this.showBackendText = visible;
    this.showCustomerserviceText = visible;
    this.showApiText = visible;
    this.showGraphicdesignText = visible;
    this.showSocialText = visible;
    this.showUiuxText = visible;
  }
}


