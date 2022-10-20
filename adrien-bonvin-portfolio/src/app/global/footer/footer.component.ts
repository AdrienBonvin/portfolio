import { Component, OnInit } from "@angular/core";

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {

  linkedin:string = "https://www.linkedin.com/in/adrien-bonvin/";
  youtube:string = "https://www.youtube.com/channel/UC2a2DuBcvjrgvpghLvh-QGw";
  git:string = "https://github.com/AdrienBonvin";
  mailText: string = "mailto:adrien.bonvin@outlook.fr;?subject=Let's have a chat! &body=The window is all yours, what can I do for you ?";

  constructor() { }

  ngOnInit(): void {
  }

  goTo(elementId: string) {
    if(elementId == 'hamburger') {
      document.getElementById(elementId)!.scrollIntoView({ block: 'start' });

    } else {
      document.getElementById(elementId)!.scrollIntoView({ block: 'end' });

    }
  }

  goToWebsite(website: string){
    window.open(website, '_blank')!.focus();
   }

   openEmail(){
    window.location.href = this.mailText;
  }
}
