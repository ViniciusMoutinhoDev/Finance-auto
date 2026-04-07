import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-upload-month',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './upload-month.component.html',
  styleUrl: './upload-month.component.scss'
})
export class UploadMonthComponent {
  batches: Array<{ month: string; files: File[] }> = [{ month: '', files: [] }];
  status = '';

  // ajuste depois para apontar para o host/IP correto
  private readonly apiBaseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  addMonth() {
    this.batches.push({ month: '', files: [] });
  }

  removeMonth(idx: number) {
    if (this.batches.length === 1) {
      this.batches = [{ month: '', files: [] }];
      return;
    }
    this.batches.splice(idx, 1);
  }

  onFileChange(idx: number, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) {
      this.batches[idx].files = [];
      return;
    }
    this.batches[idx].files = Array.from(input.files);
  }

  uploadAll() {
    const valid = this.batches.filter((b) => b.month && b.files.length);
    if (valid.length === 0) {
      this.status = 'Adicione pelo menos 1 mês com PDFs.';
      return;
    }
    if (this.batches.some((b) => !b.month || b.files.length === 0)) {
      this.status = 'Preencha todos os meses e selecione os PDFs (ou remova os vazios).';
      return;
    }

    // TODO: trocar pelo token real quando o fluxo de login JWT estiver integrado
    const token = '';
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();

    this.status = `Enviando ${this.batches.length} mês(es)...`;

    const sendNext = (i: number) => {
      if (i >= this.batches.length) {
        this.status = 'Upload concluído com sucesso.';
        this.batches = [{ month: '', files: [] }];
        return;
      }

      const batch = this.batches[i];
      const formData = new FormData();
      formData.append('month', batch.month);
      for (const file of batch.files) {
        formData.append('files', file);
      }

      this.status = `Enviando ${i + 1}/${this.batches.length} (${batch.month})...`;
      this.http.post(`${this.apiBaseUrl}/api/upload-batch`, formData, { headers }).subscribe({
        next: () => sendNext(i + 1),
        error: (err) => {
          console.error(err);
          this.status = `Erro ao enviar o mês ${batch.month}. Verifique o backend.`;
        }
      });
    };

    sendNext(0);
  }
}

