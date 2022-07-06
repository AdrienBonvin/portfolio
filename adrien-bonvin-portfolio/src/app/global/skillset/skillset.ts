import { Component, ElementRef, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-skillset',
  templateUrl: './skillset.component.html',
  styleUrls: ['./skillset.component.css']
})
export class SkillsetComponent implements OnInit {

  hamburger="Hamburger";
  coinSide!:string;
  coinQuoteVisible:boolean=false;
  tooltipOpened="";

  constructor(private el: ElementRef) { }

  @HostListener('window:scroll', [])
  scroll(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    let scrollHeight = window.scrollY - window.innerHeight;
    if (scrollHeight > 10550 && !this.coinSide) {
      this.coinSide="heads";
    }
  }
  ngOnInit(): void {
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
