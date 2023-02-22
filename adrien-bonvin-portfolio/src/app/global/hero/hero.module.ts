import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullPageImgComponent } from './hero.component';



@NgModule({
  declarations: [FullPageImgComponent],
  imports: [
    CommonModule
  ],
  exports: [
    FullPageImgComponent
  ]
})
export class FullPageImgModule { }
