Feature: simple external suite
  I should be able to load a simple test suite

  Scenario: assert equal
	Given x = 5
	And y = 5
	Then I can assert that x == y

  Scenario Outline: assert not equal
	Given x = <x>
	And y = <y>
	Then I can assert that x != y

	Examples:
	  | x | y |
      | 0 | 1 |
      | 5 | 3 |
