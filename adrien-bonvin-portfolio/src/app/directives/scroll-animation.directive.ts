import { Directive, ElementRef, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appScrollAnimation]'
})
export class ScrollAnimationDirective {

  private delay!: string;

  @HostListener('window:scroll', [])
  scroll(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    let scroll = this.mapRange(window.innerHeight, rect.top + (rect.height / 10));
    if(scroll > 0 && scroll < 1) {
      scroll = scroll
      this.delay = '-'+scroll.toFixed(2)+'s';

    } else {
      scroll = scroll;
      this.delay = scroll.toFixed(2)+'s';

    }

  }

  @HostBinding('style.animationDelay') get animationDelay(): string {
    return this.delay;
  }

  /**
   *
   * @param h2 Hauteur totale de l'écran contenant l'élément sur lequel s'applique la directive
   * @param value La limite de la page à partir de laquelle l'animation se lance
   * @returns
   */
  private mapRange(h: number, value: number): number {
    return value / h;
  }

  constructor(private el: ElementRef) { }

}
