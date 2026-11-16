import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

export interface CreateLinkRequest {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class LinkService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000';

  listLinks(): Observable<Link[]> {
    return this.http.get<Link[]>(`${this.apiUrl}/api/links`);
  }

  createLink(request: CreateLinkRequest): Observable<Link> {
    return this.http.post<Link>(`${this.apiUrl}/api/links`, request);
  }
}
