import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {
  mailText: string = "mailto:adrien.bonvin@outlook.fr;?subject=Let's have a chat! &body=The window is all yours, what can I do for you ?";


  constructor() { }

  ngOnInit(): void {
  }

  openEmail(){
      window.location.href = this.mailText;
  }
}
