import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainPageComponent } from './main-page.component';
import { FullPageImgModule } from 'src/app/global/full-page-img/full-page-img/full-page-img.module';
import { HeaderModule } from 'src/app/global/header/header/header.module';
import { ScrollingPictureTransitionModule } from 'src/app/global/scrolling-picture-transition/scrolling-picture-transition.module';
import { SkillsetModule } from 'src/app/global/skillset/skillset.module';
import { FooterModule } from 'src/app/global/footer/footer.module';
import { ContactModule } from 'src/app/global/contact/contact.module';
import { WorkModule } from 'src/app/global/work/work.module';



@NgModule({
  declarations: [
    MainPageComponent
  ],
  imports: [
    CommonModule,
    FullPageImgModule,
    HeaderModule,
    ScrollingPictureTransitionModule,
    SkillsetModule,
    FooterModule,
    ContactModule,
    WorkModule
  ],
  exports: [
    MainPageComponent
  ]
})
export class MainPageModule { }
