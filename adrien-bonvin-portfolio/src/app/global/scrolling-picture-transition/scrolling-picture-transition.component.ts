import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { NumberValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-scrolling-picture-transition',
  templateUrl: './scrolling-picture-transition.component.html',
  styleUrls: ['./scrolling-picture-transition.component.css']
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
  intervalId!: NodeJS.Timeout;

  constructor(private el: ElementRef) { }

  @HostListener('window:scroll', [])
  scroll(): void {
    let scrollHeight = window.scrollY;
    let animationTimeStamp = scrollHeight/1000;
    let isTelephone = window.innerWidth < 800;

    this.animationDelayBottomBun = this.setAnimation(animationTimeStamp, this.initialCount+1.4);

    this.animationDelaySteak = this.setAnimation(animationTimeStamp, this.initialCount+1.6);

    this.animationDelayCheese = this.setAnimation(animationTimeStamp, this.initialCount+1.8);

    this.animationDelayPickles = this.setAnimation(animationTimeStamp, this.initialCount+2);

    this.animationDelayOignons = this.setAnimation(animationTimeStamp, this.initialCount+2.2);

    this.animationDelayTomatoes = this.setAnimation(animationTimeStamp, this.initialCount+2.4);

    this.animationDelaySalad = this.setAnimation(animationTimeStamp, this.initialCount+2.6);

    this.animationDelayTopBun = this.setAnimation(animationTimeStamp, this.initialCount+2.8);

    this.opacityMainText = (animationTimeStamp)>0.9 && (animationTimeStamp)<1.5 ? animationTimeStamp*3 : 0;

    this.setTextVisibility(scrollHeight, isTelephone);
  }

  ngOnInit(): void {
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
    if(this.hamburger == 'Hamburger') {
      this.hamburger = 'Website'
    } else {
      this.hamburger = 'Hamburger'
    }
  }

  setAnimationTimestamp(timeStamp: number, delay: number):string {
    return ('-'+(timeStamp-delay).toFixed(2)+'s');
  }
  setAnimation(animationTimestamp:number, delay:number):string {
    return (animationTimestamp-delay)>0 ? (this.setAnimationTimestamp(animationTimestamp, delay)) : '0s';
  }

  setTextVisibility(scrollHeight: number, isTelephone: boolean){
    // Disparition des différents texts
    console.log(scrollHeight)

    // Apparition des différents texts
    if (scrollHeight<3500) {
      if (scrollHeight> 1600) {
        this.showDevopsText = true;
      } else {
        this.showDevopsText = false;
      }

      if (scrollHeight> 1800) {
        this.showFrontendText = true;
        isTelephone ? this.showDevopsText = false : null;
      } else {
        this.showFrontendText = false;
      }

      if (scrollHeight> 2000) {
        this.showBackendText = true;
        isTelephone ? this.showFrontendText = false : null;
      } else {
        this.showBackendText = false;
      }

      if (scrollHeight> 2300) {
        this.showApiText = true;
        isTelephone ? this.showBackendText = false : null;
      } else {
        this.showApiText = false;
      }

      if (scrollHeight> 2500) {
        this.showGraphicdesignText = true;
        isTelephone ? this.showApiText = false : null;
      } else {
        this.showGraphicdesignText = false;
      }

      if (scrollHeight> 2700) {
        this.showCustomerserviceText = true;
        isTelephone ? this.showGraphicdesignText = false : null;
      } else {
        this.showCustomerserviceText = false;
      }

      if (scrollHeight> 2900) {
        this.showSocialText = true;
        isTelephone ? this.showCustomerserviceText = false : null;
      } else {
        this.showSocialText = false;
      }

      if (scrollHeight> 3100) {
        if (isTelephone) {
          scrollHeight > 3075 ? this.showUiuxText = false : this.showUiuxText = true;
          this.showSocialText = false;
        } else {
          this.isAllTextVisible(true);
        }
      } else {
        this.showUiuxText = false;
      }
    }
    else {
      //Disparition des textes
      if (scrollHeight> 4000) {
        this.isAllTextVisible(false);
      }
      else if (scrollHeight> 3800) {
        this.showCustomerserviceText = false;
        this.showGraphicdesignText = false;
      }
      else if (scrollHeight> 3600) {
        this.showBackendText = false;
        this.showApiText = false;
      }
      else if (scrollHeight> 3500) {
        this.showDevopsText = false;
        this.showFrontendText = false;
      }
    }
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


