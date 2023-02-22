import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkSectionComponent } from './work-section.component';
import { WorkComponent } from './work/work.component';



@NgModule({
  declarations: [
    WorkSectionComponent,
    WorkComponent
  ],
  imports: [
    CommonModule,
  ],
  exports: [
    WorkSectionComponent
  ]
})
export class WorkSectionModule { }
