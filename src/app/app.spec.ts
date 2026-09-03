import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('creates the school route finder', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the primary route question', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Quel autobus');
  });

  it('keeps the footer free of the removed official-priority notice', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.textContent).not.toContain('les documents officiels STL ont priorité');
  });

  it('keeps the two validated address examples deterministic', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.preferredLineForAddress('college-letendre', '363 rue Cayer')).toBe('75C');
    expect(app.preferredLineForAddress('college-laval', "1163 Pl. d'Aiguillon")).toBe('84C');
  });

  it('classifies all 50 routes and their reference placements', () => {
    const fixture = TestBed.createComponent(App);
    const schools = fixture.componentInstance.schools;
    expect(schools.reduce((total, school) => total + school.routes.length, 0)).toBe(50);
    expect(schools.find((school) => school.slug === 'college-letendre')?.placements['75C']).toEqual([3]);
    expect(schools.find((school) => school.slug === 'college-laval')?.placements['84C']).toEqual([2, 3]);
  });
});
