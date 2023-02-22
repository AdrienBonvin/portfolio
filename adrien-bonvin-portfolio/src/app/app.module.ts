import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FullPageImgModule } from './global/hero/hero.module';
import { ContactModule } from './global/contact/contact.module';
import { FooterModule } from './global/footer/footer.module';
import { HeaderModule } from './global/header/header/header.module';
import { SkillsetModule } from './global/skillset/skillset.module';
import { WorkSectionModule } from './global/work-section/work-section.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    //Modules internes
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    HeaderModule,
    SkillsetModule,
    FooterModule,
    ContactModule,
    FullPageImgModule,
    WorkSectionModule
    //Modules externes
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
