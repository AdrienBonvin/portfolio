import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroPageComponent } from './hero-page.component';
import { FullPageImgModule } from 'src/app/global/full-page-img/full-page-img/full-page-img.module';
import { HeaderModule } from 'src/app/global/header/header/header.module';
import { ScrollingPictureTransitionModule } from 'src/app/global/scrolling-picture-transition/scrolling-picture-transition.module';



@NgModule({
  declarations: [
    HeroPageComponent
  ],
  imports: [
    CommonModule,
    FullPageImgModule,
    HeaderModule,
    ScrollingPictureTransitionModule
  ],
  exports: [
    HeroPageComponent
  ]
})
export class HeroPageModule { }
