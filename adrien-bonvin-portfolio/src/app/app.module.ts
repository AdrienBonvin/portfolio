import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderModule } from './global/header/header/header.module';
import { ScrollingPictureTransitionModule } from './global/scrolling-picture-transition/scrolling-picture-transition.module';
import { HeroPageModule } from './modules/hero-page/hero-page/hero-page.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    //Modules internes
    BrowserModule,
    AppRoutingModule,
    HeroPageModule,
    HeaderModule,
    ScrollingPictureTransitionModule

    //Modules externes
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
