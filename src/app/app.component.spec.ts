import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { Link } from './link.service';

describe('AppComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createFixture() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    http.expectOne('http://localhost:3000/api/links').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('rejects non-HTTP URLs before making a create request', () => {
    const fixture = createFixture();
    const app = fixture.componentInstance;

    app.linkForm.controls.url.setValue('ftp://example.com');
    app.linkForm.controls.url.markAsTouched();
    fixture.detectChanges();

    expect(app.linkForm.invalid).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      'Enter a valid URL beginning with http:// or https://.',
    );
    app.submit();
    http.expectNone('http://localhost:3000/api/links');
  });

  it('creates a link and refreshes the table', () => {
    const fixture = createFixture();
    const app = fixture.componentInstance;
    const link: Link = {
      code: 'aB12cd',
      url: 'https://example.com/article',
      shortUrl: 'http://localhost:3000/aB12cd',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    app.linkForm.controls.url.setValue(link.url);
    app.submit();
    http.expectOne('http://localhost:3000/api/links').flush(link);
    http.expectOne('http://localhost:3000/api/links').flush([link]);
    fixture.detectChanges();

    expect(app.createdLink()).toEqual(link);
    expect(app.links()).toEqual([link]);
    expect(fixture.nativeElement.textContent).toContain('aB12cd');
    expect(fixture.nativeElement.textContent).toContain(link.url);
    expect(fixture.nativeElement.textContent).toContain('0');
  });

  it('shows API errors inline and allows a later submission', () => {
    const fixture = createFixture();
    const app = fixture.componentInstance;

    app.linkForm.controls.url.setValue('https://example.com');
    app.submit();
    http
      .expectOne('http://localhost:3000/api/links')
      .flush({ error: 'URL is invalid' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(app.submitError()).toBe('URL is invalid');
    expect(fixture.nativeElement.textContent).toContain('URL is invalid');
    expect(app.submitting()).toBeFalse();
  });
});
