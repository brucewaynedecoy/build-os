package intake

import (
	"bytes"
	"fmt"

	"github.com/ledongthuc/pdf"
)

func convertPDF(path string) (string, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return "", fmt.Errorf("open pdf: %w", err)
	}
	defer f.Close()
	textReader, err := r.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract pdf text: %w", err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(textReader); err != nil {
		return "", err
	}
	return buf.String(), nil
}
