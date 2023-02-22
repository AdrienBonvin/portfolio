import { Component, OnInit } from '@angular/core';
import { Project } from 'src/app/common/models/project';

@Component({
  selector: 'app-work-section',
  templateUrl: './work-section.component.html',
  styleUrls: ['./work-section.component.css']
})
export class WorkSectionComponent implements OnInit {


  projects: Project[] = [
    {
      name: "La lezardière, a design-oriented website with multiple pages to promote a BnB project.",
      description: "Built with a combination of Angular (Frontend), Java/Spring (Backend) and Postgresql (Database), this webapp was built in collaboration with a teacher, for teachers. The design has been crafted taking in consideration all the client\'s needs, and mockops of the final design built on Firgma allowed for rapid feedback and validation of the final design of the website, prior to any developpement, ensuring no bad surprises regarding the final product delivered and any urgent critical  along the way.",
      mockup: "../../../assets/pictures/work/lezardiere.mp4",
      mockupMobile: "../../../assets/pictures/work/lezardiere.PNG",
      link: "https://domaine-dubuisson.web.app/",
      mockupId: "lezardiere",
    },
    {
      name: "La lezardière, a design-oriented website with multiple pages to promote a BnB project.",
      description: "Built with a combination of Angular (Frontend), Java/Spring (Backend) and Postgresql (Database), this webapp was built in collaboration with a teacher, for teachers. The design has been crafted taking in consideration all the client\'s needs, and mockops of the final design built on Firgma allowed for rapid feedback and validation of the final design of the website, prior to any developpement, ensuring no bad surprises regarding the final product delivered and any urgent critical  along the way.",
      mockup: "../../../assets/pictures/work/lezardiere.mp4",
      mockupMobile: "../../../assets/pictures/work/lezardiere.PNG",
      link: "https://domaine-dubuisson.web.app/",
      mockupId: "lezardiere",
    }
  ]

  constructor() { }

  ngOnInit(): void {
  }

}
