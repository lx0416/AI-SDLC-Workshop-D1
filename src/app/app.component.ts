import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Link, LinkService } from './link.service';

const httpUrlValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  readonly links = signal<Link[]>([]);
  readonly loading = signal(true);
  readonly listError = signal('');
  readonly submitting = signal(false);
  readonly createdLink = signal<Link | null>(null);
  readonly submitError = signal('');

  readonly linkForm = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, httpUrlValidator],
    }),
  });

  constructor(private readonly linkService: LinkService) {}

  ngOnInit(): void {
    this.loadLinks();
  }

  loadLinks(): void {
    this.loading.set(true);
    this.listError.set('');
    this.linkService.listLinks().subscribe({
      next: (links) => {
        this.links.set(links);
        this.loading.set(false);
      },
      error: () => {
        this.listError.set('Could not load links. Please try again.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    if (this.linkForm.invalid || this.submitting()) {
      this.linkForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');
    this.createdLink.set(null);
    this.linkService
      .createLink({ url: this.linkForm.controls.url.value.trim() })
      .subscribe({
        next: (link) => {
          this.createdLink.set(link);
          this.linkForm.reset();
          this.submitting.set(false);
          this.loadLinks();
        },
        error: (error: HttpErrorResponse) => {
          this.submitError.set(
            typeof error.error?.error === 'string'
              ? error.error.error
              : 'Could not shorten this URL. Please try again.',
          );
          this.submitting.set(false);
        },
      });
  }
}
