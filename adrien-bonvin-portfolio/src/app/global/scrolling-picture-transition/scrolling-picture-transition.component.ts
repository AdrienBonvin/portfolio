import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { NumberValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-scrolling-picture-transition',
  templateUrl: './scrolling-picture-transition.component.html',
  styleUrls: ['./scrolling-picture-transition.component.scss']
})
export class ScrollingPictureTransitionComponent implements OnInit {
  delay!: string;
  bottomBunMoved: boolean = false;
  steakMoved: boolean = false;
  cheeseMoved: boolean = false;
  picklesMoved: boolean = false;
  oignonsMoved: boolean = false;
  saladMoved: boolean = false;
  topBunMoved: boolean = false;
  opacityMainText: number = 0;

  showBottomBunText: boolean = false;

  animationDelayBottomBun = this.delay;
  animationDelaySteak = this.delay;
  animationDelayCheese = this.delay;
  animationDelayPickles = this.delay;
  //animationDelayTomatoes = this.delay;
  animationDelayOignons = this.delay;
  animationDelaySalad = this.delay;
  animationDelayTopBun = this.delay;
  animationTimestamp: number = 0;



  @HostListener('window:scroll', [])
  scroll(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    let scrollHeight = window.scrollY - window.innerHeight;
    console.log('Scroll Height : '+ scrollHeight)
    if (scrollHeight>9000){
      console.log('Refermer le burger à ce niveau')

    }
    else if(scrollHeight>7750) {
      this.animationTimestamp = (scrollHeight/1000-8);
      this.animationDelayTopBun ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (this.animationTimestamp>0.5) {
        this.topBunMoved = false;
      } else {
        this.topBunMoved = true;;
      }        }
    else if(scrollHeight>6750) {
      this.animationTimestamp = (scrollHeight/1000-7);
      this.animationDelaySalad ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (this.animationTimestamp>0.5) {
        this.saladMoved = false;
      } else {
        this.saladMoved = true;;
      }
    }
    else if(scrollHeight>5750) {
      this.animationTimestamp = (scrollHeight/1000-6);
      this.animationDelayOignons ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (this.animationTimestamp>0.5) {
        this.oignonsMoved = false;
      } else {
        this.oignonsMoved = true;;
      }
    }
    else if(scrollHeight>4750) {
      this.animationTimestamp = (scrollHeight/1000-5);
      this.animationDelayPickles ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (this.animationTimestamp>0.5) {
        this.picklesMoved = false;
      } else {
        this.picklesMoved = true;;
      }
    }
    else if(scrollHeight>3750) {
      this.animationTimestamp = (scrollHeight/1000-4);
      this.animationDelayCheese ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (this.animationTimestamp>0.5) {
        this.cheeseMoved = false;
      } else {
        this.cheeseMoved = true;;
      }
    }
    else if(scrollHeight>2750) {
      // ### STEAK ###

      this.animationTimestamp = ((scrollHeight/1000)-3);
      this.animationDelaySteak ='-' + this.animationTimestamp.toFixed(2)+'s';
      if (scrollHeight > 3450) {
        this.steakMoved = false;
        this.animationDelaySteak = '0s'

      } else {
        this.steakMoved = true;;
      }
    }
    else if (scrollHeight > 1750){
      // ## BOTTOM BUN + Disparition texte ###
      this.opacityMainText = 1-((scrollHeight-1750)/100);
      this.animationTimestamp = ((scrollHeight/1000)-2);
      this.animationDelayBottomBun = '-'+this.animationTimestamp.toFixed(2)+'s';
      if (scrollHeight > 2450) {
        this.showBottomBunText = true;
        this.bottomBunMoved = false;
        this.animationDelayBottomBun = '0s'
        this.animationDelaySteak = '0s'
      } else {
        this.bottomBunMoved = true;;
      }
    }
    else if (scrollHeight > 500) {
      // ## 500 à 2000 ## Apparition du texte et disparition deu burger complet au profit des images de burgers moved (Et reset de leurs anomations)
       // #1 : On supprime les buns pleins de l'étape d'en dessous si on en vient
       if (!this.topBunMoved) {
        this.changeTypeBurgertoMoved(true);
      }
      // #2 : Si le scroll arrive aux deux limites, on la set manuellement pour bien sarriver aux bornes et éviter les bugs de scroll trop rapides.
      if (scrollHeight > 1700) {
        this.opacityMainText = 100;
        this.animationDelaySteak = '0s'
      } else if (scrollHeight < 550) {
        this.setAllAnimations('0s');
        this.opacityMainText = 0;
      } else {
        // #3 : On augmente ou diminue l'opacité du texte
        this.opacityMainText = ((scrollHeight-500)/1000)*2;
      }
    }
    else if (scrollHeight > 0) {
      // ## Scroll 0 à 500 ## Les burgers pleins bougent, les burgers éclatés sont à false.
      // #1 : On supprime les buns mouvant de l'étape d'au dessus si on en vient
      if (this.topBunMoved) {
        this.changeTypeBurgertoMoved(false);
      }
      // #2 : Si le scroll arrive aux deux limites, on la set manuellement pour bien sarriver aux bornes et éviter les bugs de scroll trop rapides.
      if (scrollHeight > 450) {
        this.setAllAnimations('-0.49s');
        this.opacityMainText = 0;
      } else if (scrollHeight <50) {
        this.setAllAnimations('0s');
      } else {
        // #3 Mouvement du burger vers l'exterieur et apparition du texte
        this.setAllAnimations('-'+(scrollHeight/1000).toFixed(2)+'s');
      }
    } else  {
      // ## Scroll < 0 ## Le burger est compact, les buns eclatés sont à false et les pleins à true.
      this.changeTypeBurgertoMoved(false);
      this.setAllAnimations('0s');
      this.opacityMainText = 0
    }


      //Steak


    } /*else if (scroll > -2) {
      //Bottom Bun se met en place
      this.delay = scroll.toFixed(2)+'s';
      this.animationDelayBottomBun = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+1).toFixed(2)+'s';

    } else if (scroll > -3) {
      //Steak se met en place
      this.animationDelaySteak = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+2).toFixed(2)+'s';

    } else if (scroll > -4) {
      //Cheese se met en place
      this.animationDelayCheese = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+3).toFixed(2)+'s';

    } else if (scroll > -5) {
      //Pickles se met en place
      this.animationDelayPickles = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+4).toFixed(2)+'s';

    } else if (scroll > -6) {
      //Oignons se met en place
      this.animationDelayOignons = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+5).toFixed(2)+'s';

    } else if (scroll > -7) {
      //Salade se met en place
      this.animationDelaySalad = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10)) +6).toFixed(2)+'s';

    } else if (scroll > -8) {
      //Top Bun se met en place
      this.animationDelayTopBun = (this.mapRange(window.innerHeight, rect.top + (rect.height / 10))+7).toFixed(2)+'s';
    } else {
      this.setAllAnimations("-0.01s");

    }*/


  constructor(private el: ElementRef) { }

  ngOnInit(): void {
  }

  setAllAnimations(value:string) {
    this.animationDelayBottomBun = value;
    this.animationDelaySteak = value;
    this.animationDelayCheese = value;
    this.animationDelayPickles = value;
    this.animationDelayOignons = value;
    this.animationDelaySalad = value;
    this.animationDelayTopBun = value;
  }

  changeTypeBurgertoMoved(visible: boolean){
    this.bottomBunMoved = visible;
    this.steakMoved = visible;
    this.cheeseMoved = visible;
    this.picklesMoved = visible;
    this.oignonsMoved = visible;
    this.saladMoved = visible;
    this.topBunMoved = visible;
  }
}
