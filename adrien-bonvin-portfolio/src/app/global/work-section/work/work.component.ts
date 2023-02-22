import { Component, HostListener, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-work',
  templateUrl: './work.component.html',
  styleUrls: ['./work.component.css']
})
export class WorkComponent implements OnInit {

  @Input() projectName!:string;
  @Input() projectDescription!:string;
  @Input() projectMockup!:string;
  @Input() projectMockupMobile!:string;
  @Input() projectLink!:string;
  @Input() mockupId!:string;

  flexDirection:string = 'row';
  openComputer:boolean=false;
  hideMockupText=true;
  hoverTextVisible=false;
  phoneOpacity='0%';

  constructor() { }

  ngOnInit(): void {
    this.mockupId ? this.mockupId : '';
  }

  @HostListener('window:scroll', [])
  scroll(): void {
    let scrollHeight = window.scrollY - window.innerHeight;
    document.getElementById(this.mockupId!);
    let position = document.getElementById(this.mockupId!)?.getBoundingClientRect();
    if(position!.top >= 0 && position!.bottom <= window.innerHeight) {
      this.openComputer = true;
      this.phoneOpacity='100%';
      setTimeout(() => {
        this.hoverTextVisible = this.openComputer;
    }, 500);

    } else {
      this.openComputer = false;
      this.hoverTextVisible = false
      this.phoneOpacity='0%';
    }
  }

  goToWorkWebsite(){
   window.open(this.projectLink, '_blank')!.focus();
  }
}
