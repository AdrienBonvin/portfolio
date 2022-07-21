import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ScrollingPictureTransitionModule } from './global/scrolling-picture-transition/scrolling-picture-transition.module';
import { MainPageModule } from './modules/main-page/hero-page/main-page.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    //Modules internes
    BrowserModule,
    AppRoutingModule,
    MainPageModule,
    ScrollingPictureTransitionModule

    //Modules externes
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
