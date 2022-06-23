import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingPictureTransitionComponent } from './scrolling-picture-transition.component';
import { ScrollAnimationDirective } from 'src/app/directives/scroll-animation.directive';



@NgModule({
  declarations: [
    ScrollingPictureTransitionComponent,
    ScrollAnimationDirective
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ScrollingPictureTransitionComponent
  ]
})
export class ScrollingPictureTransitionModule { }
