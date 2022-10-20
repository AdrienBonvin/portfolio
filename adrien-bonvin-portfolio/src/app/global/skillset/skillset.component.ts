import { Component, OnDestroy, OnInit } from '@angular/core';

@Component({
  selector: 'app-skillset',
  templateUrl: './skillset.component.html',
  styleUrls: ['./skillset.component.css']
})
export class SkillsetComponent implements OnInit, OnDestroy {

  hamburger="Hamburger";
  coinSide:string ="heads";
  coinQuoteVisible:boolean=false;
  tooltipOpened="";
  intervalId!: NodeJS.Timeout;


  constructor() { }

  ngOnInit() {
    if (window.innerWidth < 1000) {
    this.intervalId = setInterval(() => {
      this.changeHamburgerText()
    }, 2000);
    ;
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

  flipCoin(){
    this.closeToolTip();
    this.coinSide = this.coinSide==="heads" ? "tails" : "heads";
  }

  openToolTip(element:string){
    if(this.tooltipOpened == element){
      this.closeToolTip();
    } else {
    this.tooltipOpened=element;
    }
  }

  closeToolTip(){
    this.tooltipOpened="";
  }
}
